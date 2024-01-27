import md5 from 'crypto-js/md5';
import { NextResponse } from 'next/server';

import { getUserByEmail } from '@/data/user';
import { db } from '@/lib/db';
import { SignUpSchema } from '@/schemas/auth';

export async function POST(request: Request) {
  const requestBody = await request.json();

  const validatedFields = SignUpSchema.safeParse(requestBody);

  if (!validatedFields.success) {
    return NextResponse.json({ message: 'Invalid fields!' }, { status: 400 });
  }

  const { email, password, hasReadTermsOfService } = validatedFields.data;

  if (!hasReadTermsOfService) {
    return NextResponse.json(
      {
        code: 400,
        data: {
          message: 'Please read the terms of service',
        },
      },
      { status: 200 },
    );
  }

  const existingUser = await getUserByEmail(email);
  if (existingUser) {
    return NextResponse.json(
      {
        code: 400,
        data: {
          message: 'Email already in use!',
        },
      },
      { status: 200 },
    );
  }

  const hashedPassword = md5(password).toString();
  await db.user.create({
    data: {
      email,
      password: hashedPassword,
    },
  });

  return NextResponse.json(
    {
      code: 200,
      data: {
        message: 'Success Create User',
      },
    },
    { status: 200 },
  );
}
