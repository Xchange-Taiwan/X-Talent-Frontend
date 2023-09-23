import { Field } from 'formik';
import { FC, ReactNode } from 'react';

interface Props {
  labelText: string | ReactNode;
  fieldName: string;
  id?: string;
}

const CheckBoxField: FC<Props> = ({ labelText, fieldName, id }) => {
  return (
    <div className="flex items-center">
      <Field
        type="checkbox"
        className="text-blue-500 checked:bg-blue-500 hover:checked:bg-blue-500 h-4 w-4 rounded focus:ring-0 focus:ring-offset-0"
        id={id}
        name={fieldName}
      />
      <label htmlFor={id} className="pl-3 text-sm">
        {labelText}
      </label>
    </div>
  );
};

export default CheckBoxField;
