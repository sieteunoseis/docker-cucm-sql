SELECT
  t.tabname,
  c.colname
FROM
  systables AS t,
  syscolumns AS c
WHERE
  t.tabid = c.tabid
  AND t.tabname = 'devicenumplanmap'