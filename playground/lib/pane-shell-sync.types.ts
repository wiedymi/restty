export type PaneShellSyncPane = {
  runtime: {
    io: {
      isPtyConnected: () => boolean;
    };
    interaction: {
      getMouseStatus: () => {
        mode: string;
      };
    };
  };
};
