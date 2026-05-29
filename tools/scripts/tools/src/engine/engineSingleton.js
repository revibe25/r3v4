let instance = null;

export function getEngine(factory) {
  if (instance) return instance;
  instance = factory();
  return instance;
}
