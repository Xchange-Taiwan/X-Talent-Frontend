import type { Meta, StoryFn } from '@storybook/react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

import { Form } from '@/components/ui/form';

import { ExpertiseSelectItem, formSchema } from './ExpertiseSelectItem';

export default {
  title: 'Profile/ExpertiseSelectItem',
  component: ExpertiseSelectItem,
  parameters: {
    /**
     * The layout parameter controls the padding and background of the preview.
     * @see https://storybook.js.org/docs/configure/story-layout#global-layout
     */
    layout: 'padded',
    /**
     * The backgrounds parameter controls the background of the preview.
     * @see https://storybook.js.org/docs/essentials/backgrounds#configuration
     */
    backgrounds: {
      default: 'light',
    },
  },
  /**
   * The args parameter controls the props that are passed to the component.
   */
  args: {
    type: 'UI Design',
  },
} as Meta<typeof ExpertiseSelectItem>;

const Template: StoryFn<typeof ExpertiseSelectItem> = (args) => {
  const form = useForm<z.infer<typeof formSchema>>({
    defaultValues: {
      expertise: [],
    },
  });

  return (
    <Form {...form}>
      <ExpertiseSelectItem {...args} form={form} />
    </Form>
  );
};

export const Default = Template.bind({});
