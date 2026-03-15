import { FilterOptions } from '@/components/filter/MentorFilterDropdown';

export const filterOptions: FilterOptions = {
  filter_positions: {
    name: 'Position',
    options: [
      { label: 'Frontend Developer', value: 'Frontend Developer' },
      { label: 'Software Engineer', value: 'Software Engineer' },
      { label: 'Bioinformatics Analyst', value: 'Bioinformatics Analyst' },
      { label: 'Infrastructure Engineer', value: 'Infrastructure Engineer' },
    ],
  },
  filter_skills: {
    name: 'Skill',
    options: [
      { label: 'Kubernetes', value: 'Kubernetes' },
      { label: 'Agile', value: 'Agile' },
      { label: 'Go', value: 'Go' },
      { label: 'Kafka', value: 'Kafka' },
      { label: 'Financial Modeling', value: 'Financial Modeling' },
      { label: 'Java', value: 'Java' },
    ],
  },
  filter_topics: {
    name: 'Topic',
    options: [
      { label: 'Microservices', value: 'Microservices' },
      { label: 'User Research', value: 'User Research' },
      { label: 'System Design', value: 'System Design' },
      { label: 'DevOps', value: 'DevOps' },
    ],
  },
  filter_expertises: {
    name: 'Expertise',
    options: [
      { label: 'DevOps', value: 'DevOps' },
      { label: 'Full Stack Development', value: 'Full Stack Development' },
      { label: 'DevStart', value: 'DevStart' },
      { label: 'Backend Development', value: 'Backend Development' },
    ],
  },
  filter_industries: {
    name: 'Industry',
    options: [
      { label: 'Technology', value: 'Technology' },
      { label: 'Healthcare', value: 'Healthcare' },
      { label: 'Finance', value: 'Finance' },
    ],
  },
};
