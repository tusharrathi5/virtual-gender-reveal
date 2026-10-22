// Feature switches for functionality that is built but temporarily turned off.

// SMS guest invites (Twilio). Off until the SMS API is connected: the dashboard hides
// the phone column, the SMS consent checkbox and the SMS wording, and sends no phone
// numbers. Set to true to bring all of that back.
export const SMS_INVITES_ENABLED = false;
