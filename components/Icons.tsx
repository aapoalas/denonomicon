/** @jsx h */
import { h } from "preact";
import { tw } from "@twind";

export function ArrowLeft() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M9.5 2L4.5 7L9.5 12"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  );
}

export function ArrowRight(props: { class?: string }) {
  return (
    <svg
      class={tw(props.class ?? "")}
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
    >
      <path
        d="M4.5 12L9.5 7L4.5 2"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  );
}

export function TriangleRight(props: { class?: string }) {
  return (
    <svg
      class={tw(props.class ?? "")}
      xmlns="http://www.w3.org/2000/svg"
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill="none"
    >
      <path d="M2.5 10L7.5 5L2.5 0V10Z" fill="currentColor" />
    </svg>
  );
}
