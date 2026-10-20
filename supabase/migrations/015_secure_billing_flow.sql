alter table "Subscription" add column if not exists "providerOrderId" text;

create unique index if not exists "Subscription_providerOrderId_key"
  on "Subscription"("providerOrderId")
  where "providerOrderId" is not null;
