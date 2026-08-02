import type { Meta, StoryObj } from '@storybook/nextjs';
import React from 'react';
import { useForm } from 'react-hook-form';

import { Form } from '@/components/ui/form';
import { defaultValues, ProfileFormValues } from '@/schemas/profileSchema';

import { SelectField, TextareaField, TextField } from './Fields';

const meta: Meta = {
  title: '業務模組元件/個人檔案(Profile)/Edit/Fields',
  tags: ['autodocs'],
};

export default meta;

//--------------------------------------------------
// 🛠️ Wrapper Components for Form Context
//--------------------------------------------------

interface TextFieldWrapperProps {
  name: keyof ProfileFormValues;
  placeholder?: string;
  type?: React.HTMLInputTypeAttribute;
  triggerError?: boolean;
  defaultValue?: string;
}

const TextFieldWrapper = ({
  name,
  placeholder,
  type = 'text',
  triggerError = false,
  defaultValue = '',
}: TextFieldWrapperProps) => {
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
        message: '輸入格式不正確，請確認後再試一次',
      });
    } else {
      form.clearErrors(name);
    }
  }, [form, name, triggerError]);

  return (
    <Form {...form}>
      <form
        className="max-w-md space-y-4 p-4"
        onSubmit={(e) => e.preventDefault()}
      >
        <TextField
          form={form}
          name={name}
          placeholder={placeholder}
          type={type}
        />
      </form>
    </Form>
  );
};

interface TextareaFieldWrapperProps {
  name: keyof ProfileFormValues;
  placeholder?: string;
  rows?: number;
  triggerError?: boolean;
  defaultValue?: string;
}

const TextareaFieldWrapper = ({
  name,
  placeholder,
  rows,
  triggerError = false,
  defaultValue = '',
}: TextareaFieldWrapperProps) => {
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
        message: '輸入字數超過限制，請重新輸入',
      });
    } else {
      form.clearErrors(name);
    }
  }, [form, name, triggerError]);

  return (
    <Form {...form}>
      <form
        className="max-w-md space-y-4 p-4"
        onSubmit={(e) => e.preventDefault()}
      >
        <TextareaField
          form={form}
          name={name}
          placeholder={placeholder}
          rows={rows}
        />
      </form>
    </Form>
  );
};

interface SelectFieldWrapperProps {
  name: keyof ProfileFormValues;
  placeholder?: string;
  options: Array<{ label: string; value: string }>;
  triggerError?: boolean;
  defaultValue?: string;
}

const SelectFieldWrapper = ({
  name,
  placeholder,
  options,
  triggerError = false,
  defaultValue = '',
}: SelectFieldWrapperProps) => {
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
        message: '請選擇一個有效的地區',
      });
    } else {
      form.clearErrors(name);
    }
  }, [form, name, triggerError]);

  return (
    <Form {...form}>
      <form
        className="max-w-md space-y-4 p-4"
        onSubmit={(e) => e.preventDefault()}
      >
        <SelectField
          form={form}
          name={name}
          placeholder={placeholder}
          options={options}
        />
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
  render: () => <TextFieldWrapper name="name" />,
};

export const TextFieldWithPlaceholder: StoryObj<typeof TextField> = {
  name: 'TextField / 包含提示文字',
  render: () => (
    <TextFieldWrapper
      name="name"
      placeholder="請輸入您的姓名（例如：王小明）"
    />
  ),
};

export const TextFieldValidationError: StoryObj<typeof TextField> = {
  name: 'TextField / 驗證錯誤狀態',
  render: () => (
    <TextFieldWrapper
      name="name"
      placeholder="請輸入姓名"
      triggerError={true}
    />
  ),
};

// 2. TextareaField Stories
export const TextareaFieldDefault: StoryObj<typeof TextareaField> = {
  name: 'TextareaField / 預設高度 (rows=6)',
  render: () => (
    <TextareaFieldWrapper name="statement" placeholder="請輸入個人簡介..." />
  ),
};

export const TextareaFieldCustomRows: StoryObj<typeof TextareaField> = {
  name: 'TextareaField / 自訂高度 (rows=3)',
  render: () => (
    <TextareaFieldWrapper name="about" placeholder="請輸入關於我..." rows={3} />
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
    <SelectFieldWrapper
      name="location"
      placeholder="請選擇地區"
      options={locationOptions}
      defaultValue="taipei"
    />
  ),
};

export const SelectFieldEmpty: StoryObj<typeof SelectField> = {
  name: 'SelectField / 空白未選擇狀態',
  render: () => (
    <SelectFieldWrapper
      name="location"
      placeholder="請選擇地區"
      options={locationOptions}
    />
  ),
};
