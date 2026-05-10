import '@testing-library/jest-dom'

// AudioContext stub for jsdom (CRIT-4 companion)
if (typeof window !== 'undefined' && !window.AudioContext) {
  // @ts-expect-error -- jsdom stub
  window.AudioContext = class {
    state = 'running'
    resume()  { return Promise.resolve() }
    close()   { return Promise.resolve() }
    createGain() { return { connect: () => undefined } }
  }
}
