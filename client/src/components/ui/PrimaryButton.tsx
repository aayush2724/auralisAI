import type { ButtonProps } from './Button';
import { Button } from './Button';

export default function PrimaryButton(props: Omit<ButtonProps, 'variant'>) {
  return <Button variant="primary" {...props} />;
}
