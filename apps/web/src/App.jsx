import React, { useState } from 'react';
import { DawLayout } from './components/DawLayout';
import { IntroSplash } from './components/IntroSplash';

export function App() {
  const [showIntro, setShowIntro] = useState(true);

  return (
    <>
      {showIntro && <IntroSplash onFinish={() => setShowIntro(false)} />}
      <DawLayout />
    </>
  );
}

export default App;