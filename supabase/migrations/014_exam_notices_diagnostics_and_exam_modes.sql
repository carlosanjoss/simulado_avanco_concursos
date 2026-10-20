create table if not exists "ExamNotice" (
  "id" text primary key,
  "userId" text not null references "User"("id") on delete cascade,
  "title" text not null,
  "examDate" timestamp(3),
  "sourceFileName" text,
  "syllabusJson" text not null,
  "active" boolean not null default true,
  "createdAt" timestamp(3) not null default current_timestamp,
  "updatedAt" timestamp(3) not null
);

create index if not exists "ExamNotice_userId_active_idx" on "ExamNotice"("userId", "active");
create index if not exists "ExamNotice_userId_updatedAt_idx" on "ExamNotice"("userId", "updatedAt");

alter table "Simulado" add column if not exists "assessmentKind" text not null default 'PRACTICE';
alter table "Simulado" add column if not exists "examBoard" text not null default 'GENERIC';
alter table "Simulado" add column if not exists "examMode" boolean not null default false;
alter table "Simulado" add column if not exists "scoringMode" text not null default 'STANDARD';
alter table "Simulado" add column if not exists "timeLimitMinutes" integer;
alter table "Simulado" add column if not exists "pauseAllowed" boolean not null default true;
alter table "Simulado" add column if not exists "feedbackMode" text not null default 'IMMEDIATE';
alter table "Simulado" add column if not exists "examNoticeId" text references "ExamNotice"("id") on delete set null;
create index if not exists "Simulado_examNoticeId_idx" on "Simulado"("examNoticeId");

alter table "Tentativa" add column if not exists "markedQuestions" text default '[]';
