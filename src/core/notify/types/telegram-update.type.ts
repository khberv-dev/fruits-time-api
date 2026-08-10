// The slice of Telegram's update payload we actually read. Everything is optional because
// the body is attacker-shaped until the webhook secret has been checked, and even then
// Telegram sends many update kinds we ignore.
export interface TelegramCallbackQuery {
  id: string;
  data?: string;
  from?: { id: number; first_name?: string; username?: string };
  message?: { message_id: number; chat?: { id: number | string } };
}

export interface TelegramUpdate {
  callback_query?: TelegramCallbackQuery;
}
