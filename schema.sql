--
-- PostgreSQL database dump
--

\restrict tGLI8hXr5KgtRLcecDcQd5eMQNFWFhVXdJ9yPiV46Od3MXCb0M7LvzN6A6W2Svi

-- Dumped from database version 16.14
-- Dumped by pg_dump version 18.6 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: partytype; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.partytype AS ENUM (
    'supplier',
    'customer'
);


ALTER TYPE public.partytype OWNER TO postgres;

--
-- Name: reminderstatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.reminderstatus AS ENUM (
    'pending',
    'called',
    'visited',
    'email_sent',
    'payment_promised',
    'paid'
);


ALTER TYPE public.reminderstatus OWNER TO postgres;

--
-- Name: transactiontype; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.transactiontype AS ENUM (
    'bill',
    'payment_out',
    'sale',
    'payment_in'
);


ALTER TYPE public.transactiontype OWNER TO postgres;

--
-- Name: userrole; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.userrole AS ENUM (
    'owner',
    'manager',
    'accountant'
);


ALTER TYPE public.userrole OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: chat_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.chat_logs (
    id integer NOT NULL,
    owner_id integer NOT NULL,
    question text NOT NULL,
    generated_sql text,
    answer text,
    created_at timestamp without time zone
);


ALTER TABLE public.chat_logs OWNER TO postgres;

--
-- Name: chat_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.chat_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.chat_logs_id_seq OWNER TO postgres;

--
-- Name: chat_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.chat_logs_id_seq OWNED BY public.chat_logs.id;


--
-- Name: parties; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.parties (
    id integer NOT NULL,
    owner_id integer NOT NULL,
    name character varying NOT NULL,
    party_type public.partytype NOT NULL,
    phone character varying,
    gst_number character varying,
    notes text,
    credit_period_days integer,
    created_at timestamp without time zone,
    is_archived boolean,
    risk_score double precision,
    risk_label character varying,
    risk_reasons text
);


ALTER TABLE public.parties OWNER TO postgres;

--
-- Name: parties_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.parties_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.parties_id_seq OWNER TO postgres;

--
-- Name: parties_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.parties_id_seq OWNED BY public.parties.id;


--
-- Name: reminders; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.reminders (
    id integer NOT NULL,
    owner_id integer NOT NULL,
    party_id integer NOT NULL,
    status public.reminderstatus,
    notes text,
    follow_up_date date,
    amount_at_time numeric(12,2),
    created_at timestamp without time zone,
    updated_at timestamp without time zone
);


ALTER TABLE public.reminders OWNER TO postgres;

--
-- Name: reminders_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.reminders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.reminders_id_seq OWNER TO postgres;

--
-- Name: reminders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.reminders_id_seq OWNED BY public.reminders.id;


--
-- Name: team_invites; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.team_invites (
    id integer NOT NULL,
    owner_id integer NOT NULL,
    email character varying NOT NULL,
    role public.userrole,
    token character varying NOT NULL,
    accepted boolean,
    created_at timestamp without time zone
);


ALTER TABLE public.team_invites OWNER TO postgres;

--
-- Name: team_invites_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.team_invites_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.team_invites_id_seq OWNER TO postgres;

--
-- Name: team_invites_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.team_invites_id_seq OWNED BY public.team_invites.id;


--
-- Name: transactions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.transactions (
    id integer NOT NULL,
    owner_id integer NOT NULL,
    party_id integer NOT NULL,
    transaction_type public.transactiontype NOT NULL,
    amount numeric(12,2) NOT NULL,
    transaction_date date NOT NULL,
    due_date date,
    notes text,
    created_by integer,
    requires_approval boolean,
    approved boolean,
    created_at timestamp without time zone
);


ALTER TABLE public.transactions OWNER TO postgres;

--
-- Name: transactions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.transactions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.transactions_id_seq OWNER TO postgres;

--
-- Name: transactions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.transactions_id_seq OWNED BY public.transactions.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id integer NOT NULL,
    business_name character varying,
    email character varying NOT NULL,
    hashed_password character varying NOT NULL,
    role public.userrole,
    business_id integer,
    created_at timestamp without time zone,
    is_active boolean
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO postgres;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: chat_logs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_logs ALTER COLUMN id SET DEFAULT nextval('public.chat_logs_id_seq'::regclass);


--
-- Name: parties id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.parties ALTER COLUMN id SET DEFAULT nextval('public.parties_id_seq'::regclass);


--
-- Name: reminders id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reminders ALTER COLUMN id SET DEFAULT nextval('public.reminders_id_seq'::regclass);


--
-- Name: team_invites id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.team_invites ALTER COLUMN id SET DEFAULT nextval('public.team_invites_id_seq'::regclass);


--
-- Name: transactions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transactions ALTER COLUMN id SET DEFAULT nextval('public.transactions_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: chat_logs chat_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_logs
    ADD CONSTRAINT chat_logs_pkey PRIMARY KEY (id);


--
-- Name: parties parties_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.parties
    ADD CONSTRAINT parties_pkey PRIMARY KEY (id);


--
-- Name: reminders reminders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reminders
    ADD CONSTRAINT reminders_pkey PRIMARY KEY (id);


--
-- Name: team_invites team_invites_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.team_invites
    ADD CONSTRAINT team_invites_pkey PRIMARY KEY (id);


--
-- Name: team_invites team_invites_token_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.team_invites
    ADD CONSTRAINT team_invites_token_key UNIQUE (token);


--
-- Name: transactions transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: ix_chat_logs_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_chat_logs_id ON public.chat_logs USING btree (id);


--
-- Name: ix_parties_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_parties_id ON public.parties USING btree (id);


--
-- Name: ix_parties_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_parties_name ON public.parties USING btree (name);


--
-- Name: ix_reminders_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_reminders_id ON public.reminders USING btree (id);


--
-- Name: ix_team_invites_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_team_invites_id ON public.team_invites USING btree (id);


--
-- Name: ix_transactions_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_transactions_id ON public.transactions USING btree (id);


--
-- Name: ix_users_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX ix_users_email ON public.users USING btree (email);


--
-- Name: ix_users_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_users_id ON public.users USING btree (id);


--
-- Name: chat_logs chat_logs_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_logs
    ADD CONSTRAINT chat_logs_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(id);


--
-- Name: parties parties_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.parties
    ADD CONSTRAINT parties_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(id);


--
-- Name: reminders reminders_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reminders
    ADD CONSTRAINT reminders_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(id);


--
-- Name: reminders reminders_party_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reminders
    ADD CONSTRAINT reminders_party_id_fkey FOREIGN KEY (party_id) REFERENCES public.parties(id);


--
-- Name: team_invites team_invites_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.team_invites
    ADD CONSTRAINT team_invites_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(id);


--
-- Name: transactions transactions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: transactions transactions_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(id);


--
-- Name: transactions transactions_party_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_party_id_fkey FOREIGN KEY (party_id) REFERENCES public.parties(id);


--
-- Name: users users_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.users(id);


--
-- PostgreSQL database dump complete
--

\unrestrict tGLI8hXr5KgtRLcecDcQd5eMQNFWFhVXdJ9yPiV46Od3MXCb0M7LvzN6A6W2Svi

