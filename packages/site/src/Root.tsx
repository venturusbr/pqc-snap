import type { FunctionComponent, ReactNode } from 'react';
import { ThemeProvider } from 'styled-components';

import { dark } from './config/theme';
import { MetaMaskProvider } from './hooks';

export type RootProps = {
  children: ReactNode;
};

export const Root: FunctionComponent<RootProps> = ({ children }) => {
  return (
    <ThemeProvider theme={dark}>
      <MetaMaskProvider>{children}</MetaMaskProvider>
    </ThemeProvider>
  );
};
