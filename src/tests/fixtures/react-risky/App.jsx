export function App({ items }) {
  return items.map((item) => <div>{item.name}</div>);
}
