import logging
import os
from typing import Any
from pydantic import BaseModel, Field
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import PromptTemplate
import threading
from collections import OrderedDict
import hashlib
import time

logger = logging.getLogger("auralis.classifier.shared")

_classifier = None
_lock = threading.Lock()


class GeminiRateLimitError(Exception):
    """Raised when the Gemini API rate limit is exceeded after retries."""

    pass


class ClassificationOutput(BaseModel):
    label_index: int = Field(
        description="The 0-based index of the most appropriate label from the candidate list."
    )
    confidence: float = Field(description="Confidence score between 0.0 and 1.0.")


class CombinedClassificationOutput(BaseModel):
    objection_index: int = Field(
        description="The 0-based index of the most appropriate objection label."
    )
    objection_confidence: float = Field(
        description="Confidence score for the objection between 0.0 and 1.0."
    )
    persona_index: int = Field(
        description="The 0-based index of the most appropriate persona label."
    )
    persona_confidence: float = Field(
        description="Confidence score for the persona between 0.0 and 1.0."
    )


class LLMZeroShotClassifier:
    def __init__(self):
        self.llm = ChatGoogleGenerativeAI(
            model=os.environ.get("GEMINI_MODEL", "gemini-3.1-flash-lite"),
            temperature=0,
            google_api_key=os.getenv("GEMINI_API_KEY"),
        )
        self.single_chain = self.prompt_single | self.llm.with_structured_output(
            ClassificationOutput
        )
        self.combined_chain = self.prompt_combined | self.llm.with_structured_output(
            CombinedClassificationOutput
        )

        self._cache = OrderedDict()
        self._cache_max_size = 200
        self._cache_lock = threading.Lock()

    @property
    def prompt_single(self):
        return PromptTemplate.from_template(
            "You are an expert sales conversation analyst.\n"
            "Classify the following sales text into exactly one of these categories (by 0-based index).\n"
            "Read the description carefully before choosing:\n\n"
            "{candidate_labels}\n\n"
            "Text to classify: {text}\n\n"
            "Pick the single best-matching label_index and provide a confidence score (0.0-1.0)."
        )

    @property
    def prompt_combined(self):
        return PromptTemplate.from_template(
            "You are an expert sales conversation analyst.\n"
            "Classify the following sales text into ONE objection category AND ONE persona category.\n\n"
            "=== OBJECTION CATEGORIES ===\n"
            "{objection_labels}\n\n"
            "=== PERSONA CATEGORIES ===\n"
            "{persona_labels}\n\n"
            "Text to classify: {text}\n\n"
            "Provide the 0-based indices for the best-matching objection and persona, along with their confidence scores (0.0-1.0)."
        )

    def _get_cache(self, cache_key: str):
        with self._cache_lock:
            if cache_key in self._cache:
                self._cache.move_to_end(cache_key)
                logger.info("Classifier cache hit for key: %s", cache_key[:8])
                return self._cache[cache_key]
        return None

    def _set_cache(self, cache_key: str, value: Any):
        with self._cache_lock:
            self._cache[cache_key] = value
            self._cache.move_to_end(cache_key)
            if len(self._cache) > self._cache_max_size:
                self._cache.popitem(last=False)

    def __call__(
        self,
        text: str,
        candidate_labels: list[str],
        descriptions: list[str] | None = None,
        **kwargs,
    ) -> dict[str, Any]:

        if descriptions and len(descriptions) == len(candidate_labels):
            formatted_labels = "\n".join(
                [
                    f"{i}: {label} — {desc}"
                    for i, (label, desc) in enumerate(
                        zip(candidate_labels, descriptions)
                    )
                ]
            )
        else:
            formatted_labels = "\n".join(
                [f"{i}: {label}" for i, label in enumerate(candidate_labels)]
            )

        cache_key = hashlib.md5(
            f"single|{text}|{formatted_labels}".encode()
        ).hexdigest()
        cached_val = self._get_cache(cache_key)
        if cached_val:
            return cached_val

        max_retries = 1
        for attempt in range(max_retries + 1):
            try:
                result: ClassificationOutput = self.single_chain.invoke(
                    {"candidate_labels": formatted_labels, "text": text}
                )
                idx = (
                    result.label_index
                    if 0 <= result.label_index < len(candidate_labels)
                    else 0
                )
                label = candidate_labels[idx]
                score = result.confidence
                out = {"labels": [label], "scores": [score]}
                self._set_cache(cache_key, out)
                return out
            except Exception as e:
                err_str = str(e)
                if "RESOURCE_EXHAUSTED" in err_str or "429" in err_str:
                    if attempt < max_retries:
                        wait = 3
                        logger.warning(
                            f"Rate limited by Gemini API, retrying in {wait}s (attempt {attempt + 1}/{max_retries})"
                        )
                        time.sleep(wait)
                    else:
                        logger.error("All retries exhausted due to rate limit")
                        raise GeminiRateLimitError(
                            "The AI is currently busy, please try again in a moment."
                        ) from e
                else:
                    logger.error(f"LLM Classification failed: {e}")
                    break

        logger.error("Returning fallback label due to non-rate-limit error")
        return {"labels": [candidate_labels[0]], "scores": [0.5]}

    def classify_combined(
        self,
        text: str,
        objection_labels: list[str],
        objection_descriptions: list[str],
        persona_labels: list[str],
        persona_descriptions: list[str],
    ) -> dict[str, Any]:

        fmt_obj = "\n".join(
            [
                f"{i}: {label} — {desc}"
                for i, (label, desc) in enumerate(
                    zip(objection_labels, objection_descriptions)
                )
            ]
        )
        fmt_per = "\n".join(
            [
                f"{i}: {label} — {desc}"
                for i, (label, desc) in enumerate(
                    zip(persona_labels, persona_descriptions)
                )
            ]
        )

        cache_key = hashlib.md5(
            f"combined|{text}|{fmt_obj}|{fmt_per}".encode()
        ).hexdigest()
        cached_val = self._get_cache(cache_key)
        if cached_val:
            return cached_val

        max_retries = 1
        for attempt in range(max_retries + 1):
            try:
                result: CombinedClassificationOutput = self.combined_chain.invoke(
                    {
                        "objection_labels": fmt_obj,
                        "persona_labels": fmt_per,
                        "text": text,
                    }
                )

                obj_idx = (
                    result.objection_index
                    if 0 <= result.objection_index < len(objection_labels)
                    else 0
                )
                per_idx = (
                    result.persona_index
                    if 0 <= result.persona_index < len(persona_labels)
                    else 0
                )

                out = {
                    "objection": {
                        "label": objection_labels[obj_idx],
                        "confidence": result.objection_confidence,
                    },
                    "persona": {
                        "label": persona_labels[per_idx],
                        "confidence": result.persona_confidence,
                    },
                }
                self._set_cache(cache_key, out)
                return out
            except Exception as e:
                err_str = str(e)
                if "RESOURCE_EXHAUSTED" in err_str or "429" in err_str:
                    if attempt < max_retries:
                        wait = 3
                        logger.warning(
                            f"Rate limited by Gemini API, retrying in {wait}s (attempt {attempt + 1}/{max_retries})"
                        )
                        time.sleep(wait)
                    else:
                        logger.error("All retries exhausted due to rate limit")
                        raise GeminiRateLimitError(
                            "The AI is currently busy, please try again in a moment."
                        ) from e
                else:
                    logger.error(f"Combined LLM Classification failed: {e}")
                    break

        logger.error("Returning fallback labels due to non-rate-limit error")
        return {
            "objection": {"label": objection_labels[0], "confidence": 0.5},
            "persona": {"label": persona_labels[0], "confidence": 0.5},
        }


def get_zeroshot_pipeline():
    """
    Load the Gemini LLM classifier in a thread-safe manner.
    Retains the get_zeroshot_pipeline name for backwards compatibility.
    """
    global _classifier
    if _classifier is None:
        with _lock:
            if _classifier is None:
                logger.info("Loading shared LLM classifier (Gemini)")
                _classifier = LLMZeroShotClassifier()
    return _classifier
