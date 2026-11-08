import type { Meta, StoryObj } from '@storybook/nextjs';
import React from 'react';
import { useForm, UseFormReturn } from 'react-hook-form';

import { Form } from '@/components/ui/form';
import { defaultValues, ProfileFormValues } from '@/schemas/profileSchema';

import { ComboboxField, SelectField, TextareaField, TextField } from './Fields';

const meta: Meta = {
  title: '業務模組元件/個人檔案(Profile)/Edit/Fields',
  tags: ['autodocs'],
};

export default meta;

//--------------------------------------------------
// 🛠️ Shared Generic Wrapper for Form Context
//--------------------------------------------------

interface GenericFieldWrapperProps {
  name: keyof ProfileFormValues;
  triggerError?: boolean;
  defaultValue?: unknown;
  errorMessage?: string;
  renderField: (form: UseFormReturn<ProfileFormValues>) => React.ReactNode;
}

const GenericFieldWrapper = ({
  name,
  triggerError = false,
  defaultValue = '',
  errorMessage = '輸入格式不正確，請確認後再試一次',
  renderField,
}: GenericFieldWrapperProps) => {
  const form = useForm<ProfileFormValues>({
    defaultValues: {
      ...defaultValues,
      [name]: defaultValue,
    },
  });

  React.useEffect(() => {
    if (triggerError) {
      form.setError(name, {
        type: 'manual',
        message: errorMessage,
      });
    } else {
      form.clearErrors(name);
    }
  }, [form, name, triggerError, errorMessage]);

  return (
    <Form {...form}>
      <form
        className="max-w-md space-y-4 p-4"
        onSubmit={(e) => e.preventDefault()}
      >
        {renderField(form)}
      </form>
    </Form>
  );
};

//--------------------------------------------------
// 📝 Stories
//--------------------------------------------------

// 1. TextField Stories
export const TextFieldDefault: StoryObj<typeof TextField> = {
  name: 'TextField / 預設狀態',
  render: () => (
    <GenericFieldWrapper
      name="name"
      renderField={(form) => <TextField control={form.control} name="name" />}
    />
  ),
};

export const TextFieldWithPlaceholder: StoryObj<typeof TextField> = {
  name: 'TextField / 包含提示文字',
  render: () => (
    <GenericFieldWrapper
      name="name"
      renderField={(form) => (
        <TextField
          control={form.control}
          name="name"
          placeholder="請輸入您的姓名（例如：王小明）"
        />
      )}
    />
  ),
};

export const TextFieldValidationError: StoryObj<typeof TextField> = {
  name: 'TextField / 驗證錯誤狀態',
  render: () => (
    <GenericFieldWrapper
      name="name"
      triggerError={true}
      renderField={(form) => (
        <TextField
          control={form.control}
          name="name"
          placeholder="請輸入姓名"
        />
      )}
    />
  ),
};

// 2. TextareaField Stories
export const TextareaFieldDefault: StoryObj<typeof TextareaField> = {
  name: 'TextareaField / 預設高度 (rows=6)',
  render: () => (
    <GenericFieldWrapper
      name="statement"
      renderField={(form) => (
        <TextareaField
          control={form.control}
          name="statement"
          placeholder="請輸入個人簡介..."
        />
      )}
    />
  ),
};

export const TextareaFieldCustomRows: StoryObj<typeof TextareaField> = {
  name: 'TextareaField / 自訂高度 (rows=3)',
  render: () => (
    <GenericFieldWrapper
      name="about"
      renderField={(form) => (
        <TextareaField
          control={form.control}
          name="about"
          placeholder="請輸入關於我..."
          rows={3}
        />
      )}
    />
  ),
};

// 3. SelectField Stories
const locationOptions = [
  { label: '台北市', value: 'taipei' },
  { label: '新北市', value: 'new_taipei' },
  { label: '台中市', value: 'taichung' },
  { label: '高雄市', value: 'kaohsiung' },
  { label: '海外地區', value: 'overseas' },
];

export const SelectFieldWithSelectedValue: StoryObj<typeof SelectField> = {
  name: 'SelectField / 已選擇選項',
  render: () => (
    <GenericFieldWrapper
      name="location"
      defaultValue="taipei"
      renderField={(form) => (
        <SelectField
          form={form}
          name="location"
          placeholder="請選擇地區"
          options={locationOptions}
        />
      )}
    />
  ),
};

export const SelectFieldEmpty: StoryObj<typeof SelectField> = {
  name: 'SelectField / 空白未選擇狀態',
  render: () => (
    <GenericFieldWrapper
      name="location"
      renderField={(form) => (
        <SelectField
          form={form}
          name="location"
          placeholder="請選擇地區"
          options={locationOptions}
        />
      )}
    />
  ),
};

// 4. ComboboxField Stories
// A larger option set than SelectField's demo — this is the pattern used for
// fields where SelectField would otherwise eagerly mount hundreds of hidden
// native <option> nodes (see ComboboxField's doc comment in Fields.tsx).
const countryOptions = [
  { label: '台灣', value: 'TWN' },
  { label: '日本', value: 'JPN' },
  { label: '韓國', value: 'KOR' },
  { label: '美國', value: 'USA' },
  { label: '加拿大', value: 'CAN' },
  { label: '英國', value: 'GBR' },
  { label: '法國', value: 'FRA' },
  { label: '德國', value: 'DEU' },
  { label: '澳洲', value: 'AUS' },
  { label: '新加坡', value: 'SGP' },
];

export const ComboboxFieldWithSelectedValue: StoryObj<typeof ComboboxField> = {
  name: 'ComboboxField / 已選擇選項',
  render: () => (
    <GenericFieldWrapper
      name="location"
      defaultValue="TWN"
      renderField={(form) => (
        <ComboboxField
          form={form}
          name="location"
          placeholder="請選擇地區"
          searchPlaceholder="搜尋地區"
          options={countryOptions}
        />
      )}
    />
  ),
};

export const ComboboxFieldEmpty: StoryObj<typeof ComboboxField> = {
  name: 'ComboboxField / 空白未選擇狀態',
  render: () => (
    <GenericFieldWrapper
      name="location"
      renderField={(form) => (
        <ComboboxField
          form={form}
          name="location"
          placeholder="請選擇地區"
          searchPlaceholder="搜尋地區"
          options={countryOptions}
        />
      )}
    />
  ),
};
