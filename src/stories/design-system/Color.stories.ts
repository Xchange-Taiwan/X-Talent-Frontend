import type { StoryObj } from '@storybook/react';

import { Color as ColorDisplay } from './Color';

const meta = {
  title: 'DesignSystem/Color',
  component: ColorDisplay,
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Color: Story = {};
