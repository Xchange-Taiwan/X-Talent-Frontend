'use client';

import { useCallback, useRef } from 'react';
import { FieldErrors, FieldValues } from 'react-hook-form';

export function useFormErrorScroll<T extends FieldValues>() {
  const formRef = useRef<HTMLFormElement>(null);

  const scrollToField = useCallback((fieldId: string) => {
    const element = document.getElementById(fieldId);
    if (element && formRef.current?.contains(element)) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, []);

  const onError = useCallback(
    (errors: FieldErrors<T>) => {
      const errorKeys = Object.keys(errors) as (keyof T)[];
      const formEl = formRef.current;

      const elementsWithErrors = errorKeys
        .map((key) => {
          const element = document.getElementById(String(key));
          if (element && formEl?.contains(element)) {
            return { key, rect: element.getBoundingClientRect() };
          }
          return null;
        })
        .filter(
          (item): item is { key: keyof T; rect: DOMRect } => item !== null
        );

      if (elementsWithErrors.length > 0) {
        elementsWithErrors.sort((a, b) => a.rect.top - b.rect.top);
        scrollToField(String(elementsWithErrors[0].key));
      }
    },
    [scrollToField]
  );

  return { formRef, onError, scrollToField };
}
