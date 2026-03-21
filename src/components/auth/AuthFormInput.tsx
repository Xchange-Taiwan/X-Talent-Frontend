'use client';

import { Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';
import { Control, FieldValues, Path } from 'react-hook-form';

import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';

interface AuthFormInputProps<T extends FieldValues> {
  name: Path<T>;
  label: string;
  placeholder: string;
  type?: string;
  control: Control<T>;
  forgotPasswordLink?: React.ReactNode;
  autocomplete: string;
}

const AuthFormInput = <T extends FieldValues>({
  name,
  label,
  placeholder,
  type = 'text',
  control,
  forgotPasswordLink,
  autocomplete,
}: AuthFormInputProps<T>) => {
  const [showPassword, setShowPassword] = useState(false);

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const isPasswordInput = type === 'password';
  const inputType = isPasswordInput
    ? showPassword
      ? 'text'
      : 'password'
    : type;

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel showErrorStyle={false}>{label}</FormLabel>
          <div className="relative">
            <FormControl>
              <Input
                placeholder={placeholder}
                type={inputType}
                autoComplete={autocomplete}
                className={isPasswordInput ? 'pr-10' : ''}
                {...(isPasswordInput ? { 'data-clarity-mask': 'true' } : {})}
                {...field}
                value={field.value ?? ''}
              />
            </FormControl>
            {isPasswordInput && (
              <button
                type="button"
                onClick={togglePasswordVisibility}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                aria-label={showPassword ? '隱藏密碼' : '顯示密碼'}
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5" />
                ) : (
                  <Eye className="h-5 w-5" />
                )}
              </button>
            )}
          </div>
          <FormMessage />
          {forgotPasswordLink}
        </FormItem>
      )}
    />
  );
};

export default AuthFormInput;
