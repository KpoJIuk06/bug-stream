package az.bugtrack.auth;

/** Where the user signed in: the site or the Chrome extension (refresh tokens live differently). */
public enum ClientType {
    WEB,
    EXTENSION
}
