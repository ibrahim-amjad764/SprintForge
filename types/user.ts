// types/user.ts

/*
    Shared User Type

    Used by:
    - AuthContext
    - Components
    - API responses

*/

export interface User {
  _id: string;
  name: string;
  email: string;
  avatar?: string;
}
