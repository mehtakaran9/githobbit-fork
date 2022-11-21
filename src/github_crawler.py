import json
import wget
import time
import csv
import requests
import math
import os

URL = "https://api.github.com/search/repositories?q="  # The basic URL to use the GitHub API
QUERY = "language:JavaScript stars:>10000"  # The personalized query (for instance, to get repositories from user 'rsain')
SUB_QUERIES = ["+created%3A<%3D2021-03-31",
              "+created%3A>%3D2014-01-01"]  # Different sub-queries if you need to collect more than 1000 elements
PARAMETERS = "&per_page=100"  # Additional parameters for the query (by default 100 items per page)
DELAY_BETWEEN_QUERIES = 10  # The time to wait between different queries to GitHub (to avoid be banned)
OUTPUT_FOLDER = "/Users/karanmehta/crawler-results/results"  # Folder where ZIP files will be stored
OUTPUT_CSV_FILE = "/Users/karanmehta/crawler-results/repositories.csv"  # Path to the CSV file generated as output

def getUrl(url):
    """ Given a URL it returns its body """
    response = requests.get(url)
    return response.json()

# To save the number of repositories processed
countOfRepositories = 0

# Output CSV file which will contain information about repositories
csv_file = open(OUTPUT_CSV_FILE, 'w')
repositories = csv.writer(csv_file, delimiter=',')
# Run queries to get information in json format and download ZIP file for each repository
for subquery in range(1, len(SUB_QUERIES) + 1):
    print("Processing subquery " + str(subquery) + " of " + str(len(SUB_QUERIES)) + " ...")
    # Obtain the number of pages for the current subquery (by default each page contains 100 items)
    url = URL + QUERY + str(SUB_QUERIES[subquery - 1]) + PARAMETERS
    data = json.loads(json.dumps(getUrl(url)))
    # print(data)
    numberOfPages = int(math.ceil(data['total_count'] / 100.0))
    print("No. of pages = " + str(numberOfPages))
    print("No. of pages = " + str(numberOfPages))

    # Results are in different pages
    for currentPage in range(4, 5):
        print("Processing page " + str(currentPage) + " of " + str(numberOfPages) + " ...")
        url = URL + QUERY + str(SUB_QUERIES[subquery - 1]) + PARAMETERS + "&page=" + str(currentPage)
        data = json.loads(json.dumps(getUrl(url)))
        # Iteration over all the repositories in the current json content page
        for item in data['items'][0:1]:
            # # Obtain user and repository names
            # user = item['owner']['login']
            # repository = item['name']
            # # Download the zip file of the current project
            # print("Downloading repository '%s' from user '%s' ..." % (repository, user))
            # url = item['clone_url']
            # fileToDownload = url[0:len(url) - 4] + "/archive/refs/heads/master.zip"
            # fileName = item['full_name'].replace("/", "#") + ".zip"
            try:
                fork_query = 'gh repo fork ' + item['full_name'] + ' --org githobbit-repos' + ' --clone=true' + ' --remote=false'
                print(fork_query)
                output = os.system(fork_query)
                dirPath = os.getcwd() + "/" + item['name']
                print(dirPath)
                docker_query = 'node /Users/karanmehta/UCD/auto/githobbit/out/autoparser.js ' + dirPath
                print(docker_query)
                output = os.system(docker_query)
                # wget.download(fileToDownload, out=OUTPUT_FOLDER + fileName)
                # repositories.writerow([user, repository, url, "downloaded"])
            except Exception as e:
                # print("Could not download file {}".format(fileToDownload))
                print(e)
                # repositories.writerow([user, repository, url, "error when downloading"])
            # Update repositories counter
            countOfRepositories = countOfRepositories + 1

    # A delay between different sub-queries
    if subquery < len(SUB_QUERIES):
        print("Sleeping " + str(DELAY_BETWEEN_QUERIES) + " seconds before the new query ...")
        time.sleep(DELAY_BETWEEN_QUERIES)

print("DONE! " + str(countOfRepositories) + " repositories have been processed.")
csv_file.close()
