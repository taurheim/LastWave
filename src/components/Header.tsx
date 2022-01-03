import React from 'react';
import { Outlet } from 'react-router-dom';

export type HeaderProps = {
  title: string;
  subtitle: string;
};

export default function Header(props: HeaderProps) {
  const { title, subtitle } = props;
  return (
    <>
      {title} - {subtitle}
      <Outlet />
    </>
  );
}
