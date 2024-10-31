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
}

const AuthFormInput = <T extends FieldValues>({
  name,
  label,
  placeholder,
  type = 'text',
  control,
  forgotPasswordLink,
}: AuthFormInputProps<T>) => {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel showErrorStyle={false}>{label}</FormLabel>
          <FormControl>
            <Input placeholder={placeholder} type={type} {...field} />
          </FormControl>
          <FormMessage />
          {forgotPasswordLink}
        </FormItem>
      )}
    />
  );
};

export default AuthFormInput;
