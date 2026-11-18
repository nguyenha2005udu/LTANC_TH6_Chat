export type RootRoutes = {
  Login: undefined;
  Main: undefined;
  /** peerId is set when opening a 1-1 chat that may not exist yet. */
  Detail: { convId: string; peerId?: string };
  CreateGroup: undefined;
  GroupInfo: { convId: string };
};
export type TabRoutes = {
  Chat: undefined;
  Contact: undefined;
  Noti: undefined;
  Setting: undefined;
};
