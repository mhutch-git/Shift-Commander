--
-- PostgreSQL database dump
--

\restrict 59hYHVUdlubhb75yK92JvOxeFCaLeqD1I7E0XlAl6EwypbUjw7RYRU4IcZLzkzk

-- Dumped from database version 16.10
-- Dumped by pg_dump version 16.10

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

DROP INDEX IF EXISTS public."IDX_session_expire";
ALTER TABLE IF EXISTS ONLY public.users DROP CONSTRAINT IF EXISTS users_pkey;
ALTER TABLE IF EXISTS ONLY public.users DROP CONSTRAINT IF EXISTS users_email_unique;
ALTER TABLE IF EXISTS ONLY public.shifts DROP CONSTRAINT IF EXISTS shifts_pkey;
ALTER TABLE IF EXISTS ONLY public.shift_assignments DROP CONSTRAINT IF EXISTS shift_assignments_pkey;
ALTER TABLE IF EXISTS ONLY public.session DROP CONSTRAINT IF EXISTS session_pkey;
ALTER TABLE IF EXISTS ONLY public.notification_logs DROP CONSTRAINT IF EXISTS notification_logs_pkey;
ALTER TABLE IF EXISTS ONLY public.day_off_requests DROP CONSTRAINT IF EXISTS day_off_requests_pkey;
ALTER TABLE IF EXISTS ONLY public.daily_assignments DROP CONSTRAINT IF EXISTS daily_assignments_pkey;
ALTER TABLE IF EXISTS public.users ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.shifts ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.shift_assignments ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.notification_logs ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.day_off_requests ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.daily_assignments ALTER COLUMN id DROP DEFAULT;
DROP SEQUENCE IF EXISTS public.users_id_seq;
DROP TABLE IF EXISTS public.users;
DROP SEQUENCE IF EXISTS public.shifts_id_seq;
DROP TABLE IF EXISTS public.shifts;
DROP SEQUENCE IF EXISTS public.shift_assignments_id_seq;
DROP TABLE IF EXISTS public.shift_assignments;
DROP TABLE IF EXISTS public.session;
DROP SEQUENCE IF EXISTS public.notification_logs_id_seq;
DROP TABLE IF EXISTS public.notification_logs;
DROP SEQUENCE IF EXISTS public.day_off_requests_id_seq;
DROP TABLE IF EXISTS public.day_off_requests;
DROP SEQUENCE IF EXISTS public.daily_assignments_id_seq;
DROP TABLE IF EXISTS public.daily_assignments;
SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: daily_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.daily_assignments (
    id integer NOT NULL,
    user_id integer NOT NULL,
    assigned_date date NOT NULL,
    shift_type character varying(10) NOT NULL,
    notes text,
    created_by_id integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: daily_assignments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.daily_assignments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: daily_assignments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.daily_assignments_id_seq OWNED BY public.daily_assignments.id;


--
-- Name: day_off_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.day_off_requests (
    id integer NOT NULL,
    user_id integer NOT NULL,
    requested_date date NOT NULL,
    reason text NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    reviewed_by_id integer,
    review_notes text,
    reviewed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    request_type character varying(30) DEFAULT 'pto'::character varying NOT NULL,
    created_by_id integer
);


--
-- Name: day_off_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.day_off_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: day_off_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.day_off_requests_id_seq OWNED BY public.day_off_requests.id;


--
-- Name: notification_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification_logs (
    id integer NOT NULL,
    recipient_id integer NOT NULL,
    type character varying(50) NOT NULL,
    message text NOT NULL,
    is_read boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: notification_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.notification_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: notification_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.notification_logs_id_seq OWNED BY public.notification_logs.id;


--
-- Name: session; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.session (
    sid character varying NOT NULL,
    sess json NOT NULL,
    expire timestamp(6) without time zone NOT NULL
);


--
-- Name: shift_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shift_assignments (
    id integer NOT NULL,
    user_id integer NOT NULL,
    shift_id integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    effective_date date NOT NULL,
    created_by_id integer
);


--
-- Name: shift_assignments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.shift_assignments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: shift_assignments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.shift_assignments_id_seq OWNED BY public.shift_assignments.id;


--
-- Name: shifts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shifts (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    shift_type character varying(10) NOT NULL,
    shift_letter character varying(1) NOT NULL,
    sergeant_id integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: shifts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.shifts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: shifts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.shifts_id_seq OWNED BY public.shifts.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id integer NOT NULL,
    email character varying(255) NOT NULL,
    password_hash text NOT NULL,
    first_name character varying(100) NOT NULL,
    last_name character varying(100) NOT NULL,
    role character varying(20) DEFAULT 'deputy'::character varying NOT NULL,
    shift_id integer,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: daily_assignments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_assignments ALTER COLUMN id SET DEFAULT nextval('public.daily_assignments_id_seq'::regclass);


--
-- Name: day_off_requests id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.day_off_requests ALTER COLUMN id SET DEFAULT nextval('public.day_off_requests_id_seq'::regclass);


--
-- Name: notification_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_logs ALTER COLUMN id SET DEFAULT nextval('public.notification_logs_id_seq'::regclass);


--
-- Name: shift_assignments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_assignments ALTER COLUMN id SET DEFAULT nextval('public.shift_assignments_id_seq'::regclass);


--
-- Name: shifts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shifts ALTER COLUMN id SET DEFAULT nextval('public.shifts_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Data for Name: daily_assignments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.daily_assignments (id, user_id, assigned_date, shift_type, notes, created_by_id, created_at) FROM stdin;
1	62	2026-04-01	day	Covering for Tomaw	26	2026-04-01 21:38:12.72859+00
\.


--
-- Data for Name: day_off_requests; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.day_off_requests (id, user_id, requested_date, reason, status, reviewed_by_id, review_notes, reviewed_at, created_at, updated_at, request_type, created_by_id) FROM stdin;
1	40	2026-04-02	.	approved	26	\N	2026-04-01 15:04:44.196+00	2026-04-01 15:04:26.500976+00	2026-04-01 15:04:44.196+00	pto	\N
2	38	2026-04-01	.	approved	26	\N	2026-04-01 15:06:24.884+00	2026-04-01 15:06:21.098813+00	2026-04-01 15:06:24.884+00	training	\N
3	36	2026-04-01	.	approved	26	\N	2026-04-01 20:54:26.933+00	2026-04-01 20:54:13.749233+00	2026-04-01 20:54:26.933+00	pto	\N
\.


--
-- Data for Name: notification_logs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.notification_logs (id, recipient_id, type, message, is_read, created_at) FROM stdin;
1	28	day_off_submitted	Mark Garcia has requested a day off on 2026-04-02.	f	2026-04-01 15:04:26.53839+00
2	40	day_off_approved	Your day-off request for 2026-04-02 has been approved.	f	2026-04-01 15:04:44.200808+00
3	28	day_off_submitted	Anthony Martin has requested a day off on 2026-04-01.	f	2026-04-01 15:06:21.103696+00
4	38	day_off_approved	Your day-off request for 2026-04-01 has been approved.	f	2026-04-01 15:06:24.888202+00
6	28	shift_assigned	D Tomaw has been assigned to your shift (Day B), effective 2026-04-01.	f	2026-04-01 15:17:34.85758+00
7	34	shift_assigned	You have been assigned to Day B, effective 2026-04-01.	f	2026-04-01 20:07:15.573496+00
9	29	shift_assigned	You have been assigned to Night A, effective 2026-04-01.	f	2026-04-01 20:13:53.546964+00
10	28	shift_assigned	You have been assigned to Day B, effective 2026-04-01.	f	2026-04-01 20:49:13.903205+00
13	34	shift_assigned	Your shift assignment has been removed. Please contact your supervisor for details.	f	2026-04-01 20:50:29.107424+00
14	28	shift_assigned	Your shift assignment has been removed. Please contact your supervisor for details.	f	2026-04-01 20:50:38.15944+00
15	34	shift_assigned	You have been assigned to Day B, effective 2026-04-01.	f	2026-04-01 20:50:45.506334+00
5	36	shift_assigned	You have been assigned to Day B, effective 2026-04-01.	t	2026-04-01 15:17:34.853719+00
8	36	shift_assigned	T Lohr has been assigned to your shift (Day B), effective 2026-04-01.	t	2026-04-01 20:07:15.57732+00
11	36	shift_assigned	Joshua Boller has been assigned to your shift (Day B), effective 2026-04-01.	t	2026-04-01 20:49:13.905984+00
12	36	shift_assigned	You have been assigned to Day B, effective 2026-04-01.	t	2026-04-01 20:49:25.027769+00
16	36	shift_assigned	Tyler Lohr has been assigned to your shift (Day B), effective 2026-04-01.	t	2026-04-01 20:50:45.508935+00
17	36	day_off_submitted	Derek Tomaw has requested a day off on 2026-04-01.	t	2026-04-01 20:54:13.754681+00
18	36	day_off_approved	Your day-off request for 2026-04-01 has been approved.	t	2026-04-01 20:54:26.936913+00
19	36	shift_assigned	You have been assigned to Day B, effective 2026-04-01.	t	2026-04-01 21:49:39.425413+00
\.


--
-- Data for Name: session; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.session (sid, sess, expire) FROM stdin;
xJeh31ZsrPF5M6Rc5c-oRfN4-xJ5cSzb	{"cookie":{"originalMaxAge":604800000,"expires":"2026-04-08T13:11:47.535Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":1,"role":"admin","shiftId":null}	2026-04-08 13:12:47
raJZ7sp6ur5DEVmEmuAj1hnxW9DNI_LB	{"cookie":{"originalMaxAge":604800000,"expires":"2026-04-08T13:42:48.069Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":31,"role":"deputy","shiftId":5}	2026-04-08 13:42:59
spX2IC6GKVJXm3ywXEvn2VqpslLlkbVP	{"cookie":{"originalMaxAge":604800000,"expires":"2026-04-08T21:49:52.262Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":36,"role":"sergeant","shiftId":6}	2026-04-08 22:18:34
4r5_LDABXVbnqqxYOkNJnGyGLja_Jej4	{"cookie":{"originalMaxAge":604800000,"expires":"2026-04-08T13:32:18.782Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":26,"role":"admin","shiftId":null}	2026-04-08 13:33:04
jSOCeDa3LbhkHBqa0ruO7-S0Y6Uu3yHM	{"cookie":{"originalMaxAge":604800000,"expires":"2026-04-08T13:28:00.379Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":27,"role":"sergeant","shiftId":5}	2026-04-08 13:28:13
9riW57DZKzqomPGcgJKmjksXqH4Hb4C2	{"cookie":{"originalMaxAge":604800000,"expires":"2026-04-08T13:40:43.598Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":26,"role":"admin","shiftId":null}	2026-04-08 13:41:29
f_FhGO1utO4jUEnnRFi1nsY0x8TjKTqM	{"cookie":{"originalMaxAge":604800000,"expires":"2026-04-08T13:33:28.428Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":27,"role":"sergeant","shiftId":5}	2026-04-08 13:33:43
BzYUMJwI8cXcSsqDP9MRNg1-YoMRsEE1	{"cookie":{"originalMaxAge":604800000,"expires":"2026-04-08T13:34:00.977Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":31,"role":"deputy","shiftId":5}	2026-04-08 13:34:09
LMCFnMI0IzP7MXGFxrmSSSzboyhbWcAm	{"cookie":{"originalMaxAge":604800000,"expires":"2026-04-08T13:42:02.620Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":27,"role":"sergeant","shiftId":5}	2026-04-08 13:42:29
fEpGeo3M5HjkVaxfoChdmVbZKU_RK0Fx	{"cookie":{"originalMaxAge":604800000,"expires":"2026-04-08T13:51:06.529Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":26,"role":"admin","shiftId":null}	2026-04-08 13:51:07
hDZ0V3LBNe5QReMdehfoP2nbMBW8tqE_	{"cookie":{"originalMaxAge":604800000,"expires":"2026-04-08T13:51:43.514Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":26,"role":"admin","shiftId":null}	2026-04-08 13:51:45
\.


--
-- Data for Name: shift_assignments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.shift_assignments (id, user_id, shift_id, created_at, effective_date, created_by_id) FROM stdin;
25	27	5	2026-04-01 13:13:25.823691+00	2026-04-01	\N
28	30	8	2026-04-01 13:13:25.823691+00	2026-04-01	\N
29	31	5	2026-04-01 13:13:25.823691+00	2026-04-01	\N
30	32	5	2026-04-01 13:13:25.823691+00	2026-04-01	\N
31	33	5	2026-04-01 13:13:25.823691+00	2026-04-01	\N
33	35	6	2026-04-01 13:13:25.823691+00	2026-04-01	\N
35	37	6	2026-04-01 13:13:25.823691+00	2026-04-01	\N
36	38	7	2026-04-01 13:13:25.823691+00	2026-04-01	\N
37	39	7	2026-04-01 13:13:25.823691+00	2026-04-01	\N
38	40	7	2026-04-01 13:13:25.823691+00	2026-04-01	\N
39	41	8	2026-04-01 13:13:25.823691+00	2026-04-01	\N
40	42	8	2026-04-01 13:13:25.823691+00	2026-04-01	\N
41	43	8	2026-04-01 13:13:25.823691+00	2026-04-01	\N
53	29	7	2026-04-01 20:13:53.543367+00	2026-04-01	\N
56	34	6	2026-04-01 20:50:45.50408+00	2026-04-01	\N
57	36	6	2026-04-01 21:49:39.422247+00	2026-04-01	\N
\.


--
-- Data for Name: shifts; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.shifts (id, name, shift_type, shift_letter, sergeant_id, created_at) FROM stdin;
5	Day A	day	a	27	2026-04-01 13:13:23.774916+00
7	Night A	night	a	29	2026-04-01 13:13:23.774916+00
8	Night B	night	b	30	2026-04-01 13:13:23.774916+00
6	Day B	day	b	36	2026-04-01 13:13:23.774916+00
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.users (id, email, password_hash, first_name, last_name, role, shift_id, is_active, created_at, updated_at) FROM stdin;
26	admin@putnamcounty.gov	$2b$10$aTuGRgcV1UGzuF3b/PW1d.P0oH/FkQjB67R8atzfBurExt555KEOK	Chief	Admin	admin	\N	t	2026-04-01 13:13:23.86768+00	2026-04-01 13:13:23.86768+00
28	josh.boller@co.putnam.in.us	$2b$10$PVQ.MGXzaJkt6FfGVS6riuu9OxyKLxYbEb8ENyPb8HlbTytOnBxNi	Joshua	Boller	admin	\N	t	2026-04-01 13:13:24.19144+00	2026-04-01 20:50:38.156+00
34	tyler.lohr@co.putnam.in.us	$2b$10$G0K2OhnpSLeylZ7sToejPuDaqC8W3i7Lh0aqSDyCbUpl/uTS4CO1a	Tyler	Lohr	deputy	6	t	2026-04-01 13:13:25.816848+00	2026-04-01 20:50:45.501+00
27	anthony.brown@co.putnam.in.us	$2b$10$MB0K6hRAkMvRHUgK2ApJrOmeGNw9CiRrwMsK.P2ROqR0Q6UonhReK	Anthony	Brown	sergeant	5	t	2026-04-01 13:13:24.19144+00	2026-04-01 13:13:24.19144+00
29	rob.soilleux@co.putnam.in.us	$2b$10$oE.NQxOFmpkSeKYTfVhvZeNWQk0avKiz34AwR1/3ipjJE5Yg61hc2	Robert	Soilleux	sergeant	7	t	2026-04-01 13:13:24.19144+00	2026-04-01 20:13:53.535+00
30	todd.hopkins@co.putnam.in.us	$2b$10$MCL1LLj5nxHbEPSN4SGHPuIC/aDcNkGanaQiiBzhSNpc.aNksNGcy	Todd	Hopkins	sergeant	8	t	2026-04-01 13:13:24.19144+00	2026-04-01 13:13:24.19144+00
31	randy.patrick@co.putnam.in.us	$2b$10$iCdWOJjV5bFSrkNvbPxHmefrF71W/OFTZVG5DvdxqGJb/EjmA7lae	Randy	Patrick	deputy	5	t	2026-04-01 13:13:25.816848+00	2026-04-01 13:13:25.816848+00
32	josh.clark@co.putnam.in.us	$2b$10$VV8UirqylUP6x872AkKyWecQgrn2YLJG0w3PxqH6hs/xAH9af4ZEy	Josh	Clark	deputy	5	t	2026-04-01 13:13:25.816848+00	2026-04-01 13:13:25.816848+00
33	tanner.nicholson@co.putnam.in.us	$2b$10$tlS1Vf1MiRHa/i1.VKq4i.u5J4UiMEp1FAJuf7NBQrtSj1bwrFoK.	Tanner	Nicholson	deputy	5	t	2026-04-01 13:13:25.816848+00	2026-04-01 13:13:25.816848+00
35	levi.martin@co.putnam.in.us	$2b$10$HJ3ifacgcA.wPYPRtuGtIugdcFis7.XQjyqpnZBCuYEjqLmkD0Oxu	Levi	Martin	deputy	6	t	2026-04-01 13:13:25.816848+00	2026-04-01 13:13:25.816848+00
37	scott.ducker@co.putnam.in.us	$2b$10$E04L0iAQrtOOSBe/13txrOmFozvcu7/.q5qAdONJH1KJFo4OXn8Iy	Scott	Ducker	deputy	6	t	2026-04-01 13:13:25.816848+00	2026-04-01 13:13:25.816848+00
38	josh.deal@co.putnam.in.us	$2b$10$4Ht9ct4FsSsKfPEIJcGJYuJ1fE7q1dG9IARBPP.FjZpDShkYtNRni	Josh	Deal	deputy	7	t	2026-04-01 13:13:25.816848+00	2026-04-01 13:13:25.816848+00
39	patrick.landis@co.putnam.in.us	$2b$10$v.Urqw15rMOuH.ZiVPxcYe/qxv5uIxgaGy4MFWUay3J3.ZKyza53m	Patrick	Landis	deputy	7	t	2026-04-01 13:13:25.816848+00	2026-04-01 13:13:25.816848+00
40	larry.freund@co.putnam.in.us	$2b$10$ILxwxzZ1ghlvCyVGGAhcHe/L6mbDomUZ1hMt3reUD40LwWuWp3ymm	Larry	Freund	deputy	7	t	2026-04-01 13:13:25.816848+00	2026-04-01 13:13:25.816848+00
41	kaleb.silbert@co.putnam.in.us	$2b$10$UhAKnnZAe6ErTkYE4XAXVemO4opk/01BpoP9l7VqaazrwqK.IlNbW	Kaleb	Silbert	deputy	8	t	2026-04-01 13:13:25.816848+00	2026-04-01 13:13:25.816848+00
42	shaun.jenkins@co.putnam.in.us	$2b$10$ev141RTId7Syk/XkFHYnveM5V.hRhOBsKHiPe7DoUOt/vcQkbgg3S	Shaun	Jenkins	deputy	8	t	2026-04-01 13:13:25.816848+00	2026-04-01 13:13:25.816848+00
43	austin.query@co.putnam.in.us	$2b$10$k8qdxBmgKmX9sI0aFq.nH.5iGP/JNfJU5lqy.eVQ4bsaxu4dfhFJG	Austin	Query	deputy	8	t	2026-04-01 13:13:25.816848+00	2026-04-01 13:13:25.816848+00
61	austin.fields@co.putnam.in.us	$2b$10$jczrEwLJ8N9Tbi0bEFHafOCUiUcYs888XA6mCAwcxxbZvRzaMnHBW	Austin	Fields	reserve	\N	t	2026-04-01 21:02:52.329163+00	2026-04-01 21:02:52.329163+00
63	samuel.deaner@co.putnam.in.us	$2b$10$jczrEwLJ8N9Tbi0bEFHafOCUiUcYs888XA6mCAwcxxbZvRzaMnHBW	Sam	Deaner	reserve	\N	t	2026-04-01 21:02:52.329163+00	2026-04-01 21:02:52.329163+00
64	travis.nicholson@co.putnam.in.us	$2b$10$jczrEwLJ8N9Tbi0bEFHafOCUiUcYs888XA6mCAwcxxbZvRzaMnHBW	Travis	Nicholson	reserve	\N	t	2026-04-01 21:02:52.329163+00	2026-04-01 21:02:52.329163+00
65	nick.smith@co.putnam.in.us	$2b$10$jczrEwLJ8N9Tbi0bEFHafOCUiUcYs888XA6mCAwcxxbZvRzaMnHBW	Nickolas	Smith	reserve	\N	t	2026-04-01 21:02:52.329163+00	2026-04-01 21:02:52.329163+00
66	brian.ramey@co.putnam.in.us	$2b$10$jczrEwLJ8N9Tbi0bEFHafOCUiUcYs888XA6mCAwcxxbZvRzaMnHBW	Brian	Ramey	reserve	\N	t	2026-04-01 21:02:52.329163+00	2026-04-01 21:02:52.329163+00
67	michael.clampitt@co.putnam.in.us	$2b$10$jczrEwLJ8N9Tbi0bEFHafOCUiUcYs888XA6mCAwcxxbZvRzaMnHBW	Michael	Clampitt	reserve	\N	t	2026-04-01 21:02:52.329163+00	2026-04-01 21:02:52.329163+00
62	michael.hutcheson@co.putnam.in.us	$2b$12$0HJUZVsqu5LDWWFMuXhR5uUlD4be5DlkYs64rKVmnpYzL/AKjLwbS	Michael	Hutcheson	reserve	\N	t	2026-04-01 21:02:52.329163+00	2026-04-01 21:48:16.001+00
36	derek.tomaw@co.putnam.in.us	$2b$12$BHUDu1mNgI.Gl/AtZzwXtu1oK2vgG4/UBDkABku8HtP1uvzMCq9em	Derek	Tomaw	sergeant	6	t	2026-04-01 13:13:25.816848+00	2026-04-01 21:49:39.415+00
\.


--
-- Name: daily_assignments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.daily_assignments_id_seq', 1, true);


--
-- Name: day_off_requests_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.day_off_requests_id_seq', 3, true);


--
-- Name: notification_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.notification_logs_id_seq', 19, true);


--
-- Name: shift_assignments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.shift_assignments_id_seq', 57, true);


--
-- Name: shifts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.shifts_id_seq', 8, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.users_id_seq', 67, true);


--
-- Name: daily_assignments daily_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_assignments
    ADD CONSTRAINT daily_assignments_pkey PRIMARY KEY (id);


--
-- Name: day_off_requests day_off_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.day_off_requests
    ADD CONSTRAINT day_off_requests_pkey PRIMARY KEY (id);


--
-- Name: notification_logs notification_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_logs
    ADD CONSTRAINT notification_logs_pkey PRIMARY KEY (id);


--
-- Name: session session_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session
    ADD CONSTRAINT session_pkey PRIMARY KEY (sid);


--
-- Name: shift_assignments shift_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_assignments
    ADD CONSTRAINT shift_assignments_pkey PRIMARY KEY (id);


--
-- Name: shifts shifts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shifts
    ADD CONSTRAINT shifts_pkey PRIMARY KEY (id);


--
-- Name: users users_email_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_unique UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: IDX_session_expire; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_session_expire" ON public.session USING btree (expire);


--
-- PostgreSQL database dump complete
--

\unrestrict 59hYHVUdlubhb75yK92JvOxeFCaLeqD1I7E0XlAl6EwypbUjw7RYRU4IcZLzkzk

