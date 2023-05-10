'use client';
import { ErrorMessage, Form, Formik, Field } from 'formik';
import { signIn } from 'next-auth/react';

const SignInPage = () => {
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
          onSubmit={async (values, { setSubmitting }) => {
            await new Promise((r) => setTimeout(r, 500));
            setSubmitting(false);
          }}
        >
          <Form>
            <div className="pb-4">
              <label
                className="block text-sm font-medium leading-6 text-gray-900"
                htmlFor="account"
              >
                Account
              </label>
              <Field
                type="text"
                className="block w-full rounded-md border-0 px-2 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-sky-600 sm:text-sm sm:leading-6"
                name="account"
              />
              <ErrorMessage name="account" />
            </div>
            <div className="pb-4">
              <label
                className="block text-sm font-medium leading-6 text-gray-900"
                htmlFor="password"
              >
                Password
              </label>
              <Field
                type="password"
                className="block w-full rounded-md border-0 px-2 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-sky-600 sm:text-sm sm:leading-6"
                name="password"
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
            onClick={() => signIn('github', { callbackUrl: '/' })}
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
        </div>
      </div>
    </div>
  );
};

export default SignInPage;
