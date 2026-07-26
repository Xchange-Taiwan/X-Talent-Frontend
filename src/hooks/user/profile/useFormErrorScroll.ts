'use client';

import { useRef } from 'react';
import { FieldErrors, FieldValues } from 'react-hook-form';

export function useFormErrorScroll<T extends FieldValues>() {
  const formRef = useRef<HTMLFormElement>(null);

  const scrollToField = (fieldId: string) => {
    const element = formRef.current
      ? (formRef.current.querySelector('#' + fieldId) as HTMLElement)
      : null;
    element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const onError = (errors: FieldErrors<T>) => {
    const errorKeys = Object.keys(errors) as (keyof T)[];
    const formEl = formRef.current;

    const elementsWithErrors = errorKeys
      .map((key) => {
        const element = formEl
          ? (formEl.querySelector('#' + String(key)) as HTMLElement)
          : null;
        if (!element) return null;
        return { key, rect: element.getBoundingClientRect() };
      })
      .filter((item): item is { key: keyof T; rect: DOMRect } => item !== null);

    if (elementsWithErrors.length > 0) {
      elementsWithErrors.sort((a, b) => a.rect.top - b.rect.top);
      scrollToField(String(elementsWithErrors[0].key));
    }
  };

  return { formRef, onError, scrollToField };
}
