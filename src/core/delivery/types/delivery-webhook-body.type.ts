export type DeliveryWebhookBody = {
  vendor_order_id: string;
  stage: number;
  order: {
    link: string | null;
  };
};
