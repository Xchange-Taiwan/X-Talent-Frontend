import clsx from 'clsx';
import { FC } from 'react';

type ButtonVariant = 'DEFAULT' | 'LINKEDIN' | 'GOOGLE';

interface Props {
  buttonText: string;
  variant?: ButtonVariant;
  type?: 'button' | 'submit';
  style?: string;
}

const Button: FC<Props> = ({
  type,
  buttonText,
  style,
  variant = 'DEFAULT',
}) => {
  return (
    <button
      type={type || 'button'}
      className={clsx([
        'flex w-full justify-center rounded-md  px-3 py-1.5 text-sm font-semibold leading-6 text-white',
        style,
        { 'bg-rose-500 hover:bg-rose-600': variant === 'GOOGLE' },
        { 'bg-blue-500 hover:bg-blue-600': variant === 'LINKEDIN' },
        {
          'bg-slate-700 hover:bg-slate-800': variant === 'DEFAULT',
        },
      ])}
    >
      {buttonText}
    </button>
  );
};

export default Button;
