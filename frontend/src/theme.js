import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  typography: {
    // The operating system's own fonts, so the app downloads no font files.
    fontFamily: [
      'system-ui',
      '-apple-system',
      '"Segoe UI"',
      'Roboto',
      '"Helvetica Neue"',
      '"Noto Sans"',
      '"Liberation Sans"',
      'Arial',
      'sans-serif',
      '"Apple Color Emoji"',
      '"Segoe UI Emoji"',
      '"Segoe UI Symbol"',
      '"Noto Color Emoji"',
    ].join(', '),
  },
});
