import type { InputHTMLAttributes } from 'react';
import { TextInput } from './Input';

export default function InputField(props: InputHTMLAttributes<HTMLInputElement>) {
  return <TextInput {...props} />;
}

