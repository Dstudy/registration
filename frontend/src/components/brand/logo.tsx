import Image from "next/image";
import clsx from "clsx";

export function Logo({ className }: { className?: string }) {
  return (
    <Image
      width={180}
      height={80}
      src='/images/logo_blue.png'
      alt="Thư viện Dương Liễu"
      className={clsx("w-24 sm:w-32 lg:w-40", className)}
    />
  );
}
