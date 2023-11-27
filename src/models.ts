import { GoogleAuth, JSONClient  } from 'google-auth-library/build/src/auth/googleauth';
import { Auth, docs_v1, classroom_v1 } from 'googleapis';

export type ClientType = JSONClient | Auth.OAuth2Client;
export type AuthContext = string | Auth.OAuth2Client | Auth.JWT | Auth.Compute | Auth.UserRefreshClient | Auth.BaseExternalAccountClient | GoogleAuth;


export interface Context {
    auth: AuthContext;
    classroom: classroom_v1.Classroom;
    docs: docs_v1.Docs;
}