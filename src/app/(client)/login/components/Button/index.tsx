import Button, { ButtonProps } from '@mui/material/Button';
import { createTheme, styled, ThemeProvider } from '@mui/material/styles';
import { FC, ReactNode } from 'react';

export const theme = createTheme({
  palette: {
    primary: {
      main: '#2E3646',
      contrastText: '#F8F9FB',
    },
    secondary: {
      main: '#E6E9EC',
      contrastText: '#5F6D7E',
    },
  },
});

const ThemeButton = styled(Button)<ButtonProps>(({ color }) => {
  return {
    fontWeight: 'bold',
    boxShadow: 'none',

    '&:hover': {
      boxShadow: 'none',
      backgroundColor: `${color === 'secondary' && 'rgb(219, 219, 219)'}`,
    },
  };
});

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
  return (
    <ThemeProvider theme={theme}>
      <ThemeButton
        fullWidth={true}
        variant="contained"
        color={color}
        type={type}
      >
        {children}
      </ThemeButton>
    </ThemeProvider>
  );
};

export default CustomButton;
