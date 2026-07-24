import React, { useEffect, useState } from 'react';

interface LiveCountdownProps {
  deadline: string;
}

export const LiveCountdown: React.FC<LiveCountdownProps> = ({ deadline }) => {
  const [timeLeft, setTimeLeft] = useState('');
  const [isOverdue, setIsOverdue] = useState(false);

  useEffect(() => {
    const targetDate = new Date(deadline).getTime();

    const updateCountdown = () => {
      const now = new Date().getTime();
      const difference = targetDate - now;

      if (difference <= 0) {
        setIsOverdue(true);
        setTimeLeft('00:00:00:00');
        return;
      }

      setIsOverdue(false);
      const days = Math.floor(difference / (1000 * 60 * 60 * 24));
      const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);

      const format = (num: number) => String(num).padStart(2, '0');
      setTimeLeft(`${format(days)}:${format(hours)}:${format(minutes)}:${format(seconds)}`);
    };

    updateCountdown(); // Initial call
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [deadline]);

  return (
    <span className={`font-mono font-medium ${isOverdue ? 'text-red-500' : 'text-gray-700'}`}>
      {timeLeft}
    </span>
  );
};
