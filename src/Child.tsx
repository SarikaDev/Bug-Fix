import React, { useEffect } from "react";

interface ChildProps {
  time: number;
  onClick: () => void;
}

const Child = ({ time, onClick }: ChildProps) => {
  console.log("C");
  useEffect(() => {
    console.log("Effect");
  }, [onClick]);
  return (
    <>
      <h2>Child {time}</h2>
    </>
  );
};
export default React.memo(Child);
