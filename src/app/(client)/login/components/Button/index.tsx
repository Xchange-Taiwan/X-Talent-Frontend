import { FC, ReactNode } from 'react';

interface Props {
  children?: string | ReactNode;
  color?: 'primary' | 'secondary';
  type?: 'button' | 'submit';
}

const CustomButton: FC<Props> = ({
  children,
  color = 'primary',
  type = 'button',
}) => {
  return <button className="btn">{children}</button>;
};

export default CustomButton;
