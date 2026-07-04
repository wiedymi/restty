# React

React integration with one `Restty` instance owned by a component lifecycle.

## Run

```sh
npm install
npm run dev
```

Start `../local-pty-server` in another terminal if you want the Connect button to
attach to a local shell.

## Pattern

- Create `Restty` inside `useEffect`.
- Store the instance in a ref.
- Call `destroy()` from the effect cleanup.
- Keep live connection values in refs for menu callbacks and button handlers.
