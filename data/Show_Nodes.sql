SELECT
  name,
  description,
  isactive
FROM
  processnode
WHERE
  nodeid > '1'
ORDER BY
  description