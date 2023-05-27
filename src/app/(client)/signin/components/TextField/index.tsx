import { ErrorMessage, Field } from 'formik';
import { FC } from 'react';

interface Props {
  type: 'text' | 'password';
  labelText: string;
  fieldName: string;
  id?: string;
  placeholder?: string;
}

const TextField: FC<Props> = ({
  type,
  labelText,
  fieldName,
  placeholder,
  id,
}) => {
  return (
    <div className="pb-4">
      <label
        className="block text-sm font-medium leading-6 text-gray-900"
        htmlFor={id}
      >
        {labelText}
      </label>
      <Field
        className="block w-full rounded-md border-0 px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-sky-600 sm:text-sm sm:leading-6"
        type={type}
        id={id}
        name={fieldName}
        placeholder={placeholder}
      />
      <ErrorMessage name={fieldName} />
    </div>
  );
};

export default TextField;
