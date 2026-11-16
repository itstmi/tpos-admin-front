import { useEffect, useState } from 'react';
import { Button } from './ui';

// Two clicks instead of a popup: the first asks, the second does it. Goes back after 4 seconds.
const ConfirmButton = ({ onConfirm, busy, tone = 'emerald', confirmText = 'Sure?', children, ...props }) => {
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    if (!asking) return undefined;
    const t = setTimeout(() => setAsking(false), 4000);
    return () => clearTimeout(t);
  }, [asking]);

  return (
    <Button
      {...props}
      tone={asking ? 'red' : tone}
      busy={busy}
      onClick={() => {
        if (!asking) return setAsking(true);
        setAsking(false);
        onConfirm();
      }}
    >
      {asking ? confirmText : children}
    </Button>
  );
};

export default ConfirmButton;
