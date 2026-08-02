import type { ButtonProps } from './Button';
import { Button } from './Button';

export default function SecondaryButton(props: Omit<ButtonProps, 'variant'>) {
  return <Button variant="secondary" {...props} />;
}
