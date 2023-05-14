'use client';
import { ErrorMessage, Form, Formik, Field } from 'formik';
import { signIn, signOut, useSession } from 'next-auth/react';

const LogInPage = () => {
  const { data: session } = useSession();

  console.log(session);

  return (
    <div className="flex min-h-full flex-col justify-center px-6 py-12 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-sm">
        <h2 className="mt-10 text-center text-2xl font-bold leading-9 tracking-tight text-gray-900">
          Sign In
        </h2>
      </div>

      <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-sm">
        <Formik
          initialValues={{
            account: '',
            password: '',
          }}
          onSubmit={async (params, { setSubmitting }) => {
            await signIn('credentials', {
              callbackUrl: '/Dashboard',
              ...params,
            });
            setSubmitting(false);
          }}
        >
          <Form>
            <div className="pb-4">
              <label className="block text-sm font-medium leading-6 text-gray-900">
                Account
              </label>
              <Field
                type="text"
                className="block w-full rounded-md border-0 px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-sky-600 sm:text-sm sm:leading-6"
                name="account"
                placeholder="Enter your account"
              />
              <ErrorMessage name="account" />
            </div>
            <div className="pb-4">
              <label className="block text-sm font-medium leading-6 text-gray-900">
                Password
              </label>
              <Field
                type="password"
                className="block w-full rounded-md border-0 p-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-sky-600 sm:text-sm sm:leading-6"
                name="password"
                placeholder="Enter your password"
              />
              <ErrorMessage name="password" />
            </div>
            <div className="py-4">
              <button
                type="submit"
                className="flex w-full justify-center rounded-md bg-cyan-500 px-3 py-1.5 text-sm font-semibold leading-6 text-white shadow-sm hover:bg-cyan-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
              >
                Sign in
              </button>
            </div>
          </Form>
        </Formik>

        <hr />

        <div className="py-4">
          <button
            type="button"
            className="mb-4 flex w-full justify-center rounded-md bg-gray-500 px-3 py-1.5 text-sm font-semibold leading-6 text-white shadow-sm hover:bg-gray-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            onClick={() => signIn('github', { callbackUrl: '/Dashboard' })}
          >
            Sign in with Github
          </button>

          <button
            type="button"
            className="mb-4 flex w-full justify-center rounded-md bg-sky-500 px-3 py-1.5 text-sm font-semibold leading-6 text-white shadow-sm hover:bg-sky-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            onClick={() => signIn('linkedin', { callbackUrl: '/Dashboard' })}
          >
            Sign in with LinkedIn
          </button>

          <hr />

          <button
            type="button"
            className="mb-4 flex w-full justify-center rounded-md bg-rose-500 px-3 py-1.5 text-sm font-semibold leading-6 text-white shadow-sm hover:bg-rose-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            onClick={() => signOut()}
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
};

export default LogInPage;
