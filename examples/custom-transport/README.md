# Custom Transport

Demonstrates a custom `PtyTransport` without WebSockets.

The example implements an in-memory echo transport and passes it through
`services.ptyTransport`.

## Run

```sh
npm install
npm run dev
```

## Key API

```ts
import { Restty, type PtyTransport } from "restty";

const restty = new Restty({
  root,
  services: {
    ptyTransport: myTransport satisfies PtyTransport,
  },
});
```
