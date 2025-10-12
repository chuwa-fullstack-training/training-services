import { Elysia, t } from 'elysia';

const LEETCODE_API_URL = 'https://leetcode.com/graphql';

export const UserSessionProgressResponse = t.Object({
  data: t.Object({
    matchedUser: t.Object({
      submitStats: t.Object({
        acSubmissionNum: t.Array(
          t.Object({
            difficulty: t.String(),
            count: t.Number(),
            submissions: t.Number()
          })
        ),
        totalSubmissionNum: t.Array(
          t.Object({
            difficulty: t.String(),
            count: t.Number(),
            submissions: t.Number()
          })
        )
      })
    })
  })
});

export const ProblemListResponse = t.Object({
  data: t.Object({
    userProgressQuestionList: t.Object({
      totalNum: t.Number(),
      questions: t.Array(t.Any())
    })
  })
});

export const leetcodeRouter = new Elysia({ prefix: '/api/leetcode' })
  .get(
    '/userSession',
    async ({ query }) => {
      const response = await fetch(LEETCODE_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          operationName: 'userSessionProgress',
          query: `
        query userSessionProgress($username: String!) {
            matchedUser(username: $username) {
                submitStats {
                    acSubmissionNum {
                        difficulty
                        count
                        submissions
                    }
                    totalSubmissionNum {
                        difficulty
                        count
                        submissions
                    }
                }
            }
        }
`,
          variables: {
            username: query.username
          }
        })
      });
      const data = await response.json();
      return data;
    },
    {
      detail: {
        tags: ['Leetcode']
      },
      query: t.Object({
        username: t.String()
      }),
      response: {
        200: UserSessionProgressResponse
      }
    }
  )
  .post(
    '/practiceHistory',
    async ({ body: { filters }, cookie: { name } }) => {
      name.value = {
        LEETCODE_SESSION:
          'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJfYXV0aF91c2VyX2lkIjoiNDk5Mjk5IiwiX2F1dGhfdXNlcl9iYWNrZW5kIjoiYWxsYXV0aC5hY2NvdW50LmF1dGhfYmFja2VuZHMuQXV0aGVudGljYXRpb25CYWNrZW5kIiwiX2F1dGhfdXNlcl9oYXNoIjoiOTQ5MDlhYTZjNDc1MTk5NzNiMjBlMDM4ZWY2MzVmYzM0NmIxMWY2OTQzMGU3MGM2MDg0M2I5ZDNkMTlkNmE1NyIsInNlc3Npb25fdXVpZCI6IjM4N2I2Y2IyIiwiaWQiOjQ5OTI5OSwiZW1haWwiOiJyb2NoZWVyc0BnbWFpbC5jb20iLCJ1c2VybmFtZSI6InJvY2hlZXJzIiwidXNlcl9zbHVnIjoicm9jaGVlcnMiLCJhdmF0YXIiOiJodHRwczovL2Fzc2V0cy5sZWV0Y29kZS5jb20vdXNlcnMvZGVmYXVsdF9hdmF0YXIuanBnIiwicmVmcmVzaGVkX2F0IjoxNzQwMjk1NTA0LCJpcCI6IjI2MDA6MTcwMjo2OTUwOmNhZTA6NzEwNDo4YjEwOjE4NjU6YTFmZCIsImlkZW50aXR5IjoiYjk3N2UxMGQxY2IyNjEwNzkwOWU5N2Q1MWE2ODgzMjMiLCJkZXZpY2Vfd2l0aF9pcCI6WyIzNjY3MjQ3Y2E4NzAzYjRjYjUxODNkZjRhYmQwOThiYSIsIjI2MDA6MTcwMjo2OTUwOmNhZTA6NzEwNDo4YjEwOjE4NjU6YTFmZCJdLCJfc2Vzc2lvbl9leHBpcnkiOjEyMDk2MDB9.I5u1q7IqazjeHXfpOBr_WVNrEygHFC0SoRsFktYqD14'
      };
      const response = await fetch(LEETCODE_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `LEETCODE_SESSION=${name.value.LEETCODE_SESSION}`
        },
        body: JSON.stringify({
          operationName: 'userProgressQuestionList',
          query: `
    query userProgressQuestionList($filters: UserProgressQuestionListInput) {
  userProgressQuestionList(filters: $filters) {
    totalNum
    questions {
      translatedTitle
      frontendId
      title
      titleSlug
      difficulty
      lastSubmittedAt
      numSubmitted
      questionStatus
      lastResult
      topicTags {
        name
        nameTranslated
        slug
      }
    }
  }
}
      `,
          variables: {
            filters: {
              limit: filters?.limit,
              skip: filters?.skip
            }
          }
        })
      });
      const data = await response.json();
      console.log(data);
      return data;
    },
    {
      body: t.Object({
        filters: t.Optional(
          t.Object({
            limit: t.Optional(t.Number({ default: 10 })),
            skip: t.Optional(t.Number({ default: 0 })),
            difficulty: t.Optional(t.String()),
            paidOnly: t.Optional(t.Boolean()),
            status: t.Optional(t.String()),
            topicTags: t.Optional(t.Array(t.String()))
          })
        )
      }),
      cookie: t.Cookie({
        name: t.Optional(
          t.Object({
            LEETCODE_SESSION: t.String()
          })
        )
      }),
      detail: {
        tags: ['Leetcode']
      },
      response: {
        200: ProblemListResponse
      }
    }
  );
