import type { Meta, StoryObj } from '@storybook/nextjs';

import SearchBar from './search-bar';

const meta: Meta<typeof SearchBar> = {
  title: 'Components/UI/SearchBar',
  component: SearchBar,
  tags: ['autodocs'],
  argTypes: {
    placeholder: {
      control: 'text',
      description: 'The placeholder text of the search bar',
    },
  },
};

export default meta;
type Story = StoryObj<typeof SearchBar>;

// 1. Basic Interactive Demo
export const Default: Story = {
  args: {
    onSearch: async (query) => {
      alert(`正在搜尋: ${query}`);
    },
    placeholder: '搜尋想精進的領域、導師姓名或產業關鍵字...',
  },
};
