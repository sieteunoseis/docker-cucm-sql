SELECT
  t.tabname,
  COUNT(c.colname) AS COUNT
FROM
  systables t,
  syscolumns c
WHERE
  t.tabid = c.tabid
  AND c.colname LIKE 'fkcallingsearchspace%'
GROUP BY
  t.tabname