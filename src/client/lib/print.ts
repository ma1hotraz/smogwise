/** Browser adapter for printing, so components never touch `window` directly. */
export function printPage(): void {
  window.print();
}
